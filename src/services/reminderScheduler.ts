import cron from 'node-cron';
import prisma from '../config/db';
import { sendEmail, getReminderEmailHtml } from './emailService';

// Function to process pending reminders
export const processPendingReminders = async () => {
  console.log('⏰ Running reminder check task...');
  try {
    const now = new Date();

    // Find unsent reminders whose trigger dates are in the past or present
    const pendingReminders = await prisma.reminder.findMany({
      where: {
        sent: false,
        triggerDate: {
          lte: now,
        },
        item: {
          status: 'ACTIVE',
        },
      },
      include: {
        item: {
          include: {
            user: true,
          },
        },
      },
    });

    console.log(`Found ${pendingReminders.length} pending reminders to process.`);

    for (const reminder of pendingReminders) {
      const { item } = reminder;
      const user = item.user;
      
      const daysRemaining = Math.max(
        0,
        Math.ceil((item.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );

      let emailSent = false;
      let notificationCreated = false;

      // 1. Send Email Reminder
      if (reminder.type === 'EMAIL' || reminder.type === 'BOTH') {
        const subject = `Renewal Alert: ${item.name} expires in ${daysRemaining} days!`;
        const emailHtml = getReminderEmailHtml(
          user.name,
          item.name,
          item.category,
          item.expiryDate,
          daysRemaining
        );
        emailSent = await sendEmail(user.email, subject, emailHtml);
      }

      // 2. Create In-App Notification
      if (reminder.type === 'IN_APP' || reminder.type === 'BOTH') {
        try {
          await prisma.notification.create({
            data: {
              userId: user.id,
              title: `Upcoming Renewal: ${item.name}`,
              message: `Your ${item.category} "${item.name}" will expire on ${item.expiryDate.toLocaleDateString()} (${daysRemaining} days left).`,
            },
          });
          notificationCreated = true;
        } catch (dbErr) {
          console.error(`Failed to create in-app notification for item ${item.id}:`, dbErr);
        }
      }

      // 3. Mark reminder as sent
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          sent: true,
          sentAt: now,
        },
      });

      console.log(`Processed reminder for item "${item.name}" (Email: ${emailSent}, In-App: ${notificationCreated})`);
    }
  } catch (error) {
    console.error('Error running pending reminders task:', error);
  }
};

// Function to scan and update expired items
export const checkAndMarkExpiredItems = async () => {
  console.log('⏰ Running expiration check task...');
  try {
    const now = new Date();

    // Find active items whose expiry dates are in the past
    const expiredItems = await prisma.renewalItem.findMany({
      where: {
        status: 'ACTIVE',
        expiryDate: {
          lte: now,
        },
      },
      include: {
        user: true,
      },
    });

    console.log(`Found ${expiredItems.length} items that have expired.`);

    for (const item of expiredItems) {
      // Use transaction to update status and notify
      await prisma.$transaction(async (tx) => {
        // Update item status
        await tx.renewalItem.update({
          where: { id: item.id },
          data: { status: 'EXPIRED' },
        });

        // Create in-app notification
        await tx.notification.create({
          data: {
            userId: item.userId,
            title: `Item Expired: ${item.name}`,
            message: `Your ${item.category} "${item.name}" expired on ${item.expiryDate.toLocaleDateString()}.`,
          },
        });
      });

      // Send expiration email
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #ef4444; text-align: center;">Item Expired</h2>
          <p>Hello ${item.user.name || 'User'},</p>
          <p>Your subscription/item has expired.</p>
          <div style="background-color: #fef2f2; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <p><strong>Item:</strong> ${item.name}</p>
            <p><strong>Category:</strong> ${item.category}</p>
            <p><strong>Expiration Date:</strong> ${item.expiryDate.toLocaleDateString()}</p>
          </div>
          <p>Please update or renew this item in Renewal Radar if you continue to use it.</p>
        </div>
      `;
      await sendEmail(item.user.email, `Expired Alert: ${item.name} has expired`, emailHtml);

      console.log(`Marked item "${item.name}" as EXPIRED and notified user.`);
    }
  } catch (error) {
    console.error('Error running expiration check task:', error);
  }
};

// Initialize Cron Jobs
export const initScheduler = () => {
  // Run daily at 9:00 AM (production pattern)
  cron.schedule('0 9 * * *', async () => {
    await processPendingReminders();
    await checkAndMarkExpiredItems();
  });

  // Also run every 10 minutes in development/debug mode for convenience (if needed)
  if (process.env.NODE_ENV === 'development') {
    console.log('⚙️ Development Scheduler active: Running check checks every 5 minutes.');
    cron.schedule('*/5 * * * *', async () => {
      await processPendingReminders();
      await checkAndMarkExpiredItems();
    });
  }
  
  console.log('⏰ Reminder and Expiration Schedulers initialized.');
};
