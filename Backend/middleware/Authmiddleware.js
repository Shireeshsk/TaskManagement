import jwt from "jsonwebtoken";
import { config } from "dotenv";
config();

export const authenticate = (req, res, next) => {
  try {
    const accessToken = req.cookies?.access_token;

    if (!accessToken) {
      return res.status(401).json({
        message: "Authentication required"
      });
    }

    const decoded = jwt.verify(accessToken, process.env.ACCESS);

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    return next();

  } catch (error) {

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        code: "TOKEN_EXPIRED", 
        message: "Access token expired"
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        code: "INVALID_TOKEN",
        message: "Invalid access token"
      });
    }

    return res.status(500).json({
      message: "Authentication failed"
    });
  }
};

export const authorize = (...allowedRoles) => {
  return (req, res, next) => {

    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required"
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Forbidden: insufficient permissions",
        requiredRoles: allowedRoles,
        currentRole: req.user.role
      });
    }

    return next();
  };
};