import { Request, Response, NextFunction } from "express";


export const onlyAdminCanChangeRole = (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  const requester = request.user;

  if (request.body.role !== undefined) {
    if (requester?.role !== "ADMIN") {
      return response.status(403).json({
        status: false,
        message: "Only admin can change role"
      });
    }
  }

  next();
};