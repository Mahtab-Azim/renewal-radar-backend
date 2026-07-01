import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../config/db';
import { BadRequestError, NotFoundError } from '../utils/errors';

// Helper to calculate reminder trigger date
const calculateTriggerDate = (expiryDate: Date, remindBeforeDays: number): Date => {
  const trigger = new Date(expiryDate);
  trigger.setDate(trigger.getDate() - remindBeforeDays);
  // Set to early morning (e.g., 9:00 AM) on the trigger day
  trigger.setHours(9, 0, 0, 0);
  return trigger;
};

export const createItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new NotFoundError('User not found');

    const {
      name,
      category,
      cost,
      currency,
      expiryDate,
      renewalCycle,
      remindBeforeDays,
      description,
    } = req.body;

    if (!name || !category || !expiryDate) {
      throw new BadRequestError('Name, category, and expiryDate are required fields');
    }

    const parsedExpiryDate = new Date(expiryDate);
    if (isNaN(parsedExpiryDate.getTime())) {
      throw new BadRequestError('Invalid expiryDate format');
    }

    const parsedRemindBeforeDays = remindBeforeDays !== undefined ? parseInt(remindBeforeDays, 10) : 7;
    if (isNaN(parsedRemindBeforeDays) || parsedRemindBeforeDays < 0) {
      throw new BadRequestError('remindBeforeDays must be a positive number');
    }

    // Determine status (if expiry date is in the past, set to EXPIRED, else ACTIVE)
    const status = parsedExpiryDate < new Date() ? 'EXPIRED' : 'ACTIVE';

    // Create item and its reminder in a transaction
    const item = await prisma.$transaction(async (tx) => {
      const newItem = await tx.renewalItem.create({
        data: {
          userId,
          name,
          category,
          cost: cost !== undefined ? parseFloat(cost) : null,
          currency: currency || 'USD',
          expiryDate: parsedExpiryDate,
          renewalCycle: renewalCycle || 'ANNUAL',
          remindBeforeDays: parsedRemindBeforeDays,
          description,
          status,
        },
      });

      // Calculate trigger date for the reminder
      const triggerDate = calculateTriggerDate(parsedExpiryDate, parsedRemindBeforeDays);

      // Create reminder record
      await tx.reminder.create({
        data: {
          itemId: newItem.id,
          triggerDate,
          sent: false,
          type: 'BOTH',
        },
      });

      return newItem;
    });

    res.status(201).json({
      status: 'success',
      data: {
        item,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getItems = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new NotFoundError('User not found');

    const { status, category } = req.query;

    const whereClause: any = { userId };
    if (status) whereClause.status = status as string;
    if (category) whereClause.category = category as string;

    const items = await prisma.renewalItem.findMany({
      where: whereClause,
      orderBy: {
        expiryDate: 'asc', // Soonest to expire first
      },
      include: {
        reminders: {
          orderBy: {
            triggerDate: 'asc',
          },
        },
      },
    });

    res.status(200).json({
      status: 'success',
      results: items.length,
      data: {
        items,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const item = await prisma.renewalItem.findFirst({
      where: { id, userId },
      include: { reminders: true },
    });

    if (!item) {
      throw new NotFoundError('Renewal item not found or you do not have permission to access it');
    }

    res.status(200).json({
      status: 'success',
      data: {
        item,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const {
      name,
      category,
      cost,
      currency,
      expiryDate,
      renewalCycle,
      remindBeforeDays,
      description,
      status,
    } = req.body;

    // Check ownership first
    const existingItem = await prisma.renewalItem.findFirst({
      where: { id, userId },
    });

    if (!existingItem) {
      throw new NotFoundError('Renewal item not found or you do not have permission to edit it');
    }

    const updatedData: any = {};
    if (name !== undefined) updatedData.name = name;
    if (category !== undefined) updatedData.category = category;
    if (cost !== undefined) updatedData.cost = cost !== null ? parseFloat(cost) : null;
    if (currency !== undefined) updatedData.currency = currency;
    if (description !== undefined) updatedData.description = description;
    if (renewalCycle !== undefined) updatedData.renewalCycle = renewalCycle;
    if (status !== undefined) updatedData.status = status;

    let expiryChanged = false;
    let remindBeforeDaysChanged = false;

    if (expiryDate !== undefined) {
      const parsedExpiryDate = new Date(expiryDate);
      if (isNaN(parsedExpiryDate.getTime())) {
        throw new BadRequestError('Invalid expiryDate format');
      }
      updatedData.expiryDate = parsedExpiryDate;
      expiryChanged = true;

      // Auto-update status if the expiry changes and status is not manually provided
      if (status === undefined) {
        updatedData.status = parsedExpiryDate < new Date() ? 'EXPIRED' : 'ACTIVE';
      }
    }

    if (remindBeforeDays !== undefined) {
      const parsedRemindBeforeDays = parseInt(remindBeforeDays, 10);
      if (isNaN(parsedRemindBeforeDays) || parsedRemindBeforeDays < 0) {
        throw new BadRequestError('remindBeforeDays must be a positive number');
      }
      updatedData.remindBeforeDays = parsedRemindBeforeDays;
      remindBeforeDaysChanged = true;
    }

    // Update item and adjust reminder in transaction
    const updatedItem = await prisma.$transaction(async (tx) => {
      const item = await tx.renewalItem.update({
        where: { id },
        data: updatedData,
      });

      // If expiry date or reminder days changed, update the unsent reminder
      if (expiryChanged || remindBeforeDaysChanged) {
        const triggerDate = calculateTriggerDate(item.expiryDate, item.remindBeforeDays);

        // Find if there is an unsent reminder
        const unsentReminder = await tx.reminder.findFirst({
          where: { itemId: id, sent: false },
        });

        if (unsentReminder) {
          await tx.reminder.update({
            where: { id: unsentReminder.id },
            data: { triggerDate },
          });
        } else {
          // If no unsent reminder exists, create a new one (unless it is already in the past, but we create it anyway)
          await tx.reminder.create({
            data: {
              itemId: id,
              triggerDate,
              sent: false,
              type: 'BOTH',
            },
          });
        }
      }

      return item;
    });

    res.status(200).json({
      status: 'success',
      data: {
        item: updatedItem,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const existingItem = await prisma.renewalItem.findFirst({
      where: { id, userId },
    });

    if (!existingItem) {
      throw new NotFoundError('Renewal item not found or you do not have permission to delete it');
    }

    await prisma.renewalItem.delete({
      where: { id },
    });

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
