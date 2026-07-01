import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { env } from '../config/env';

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors: any = undefined;

  // Check if it's our custom operational AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  }

  // Handle Prisma validation or query errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as any;
    // P2002: Unique constraint failed
    if (prismaErr.code === 'P2002') {
      statusCode = 409;
      const target = prismaErr.meta?.target ? (prismaErr.meta.target as string[]).join(', ') : 'Field';
      message = `${target} already exists.`;
    }
  }

  // Handle JWT validation errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please log in again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your token has expired. Please log in again.';
  }

  // Log unexpected errors (500)
  if (statusCode === 500) {
    console.error('ERROR 💥:', err);
  }

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(errors && { errors }),
    ...(env.nodeEnv === 'development' && { stack: err.stack }),
  });
};
