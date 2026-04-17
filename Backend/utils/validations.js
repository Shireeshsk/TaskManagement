import Joi from 'joi';

export function validateEmail(email) {
  const schema = Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Invalid email format',
      'string.empty': 'Email is required'
    });

  return schema.validate(email);
}

export function validateName(name) {
  const schema = Joi.string()
    .min(2)
    .max(50)
    .trim()
    .required()
    .messages({
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least 2 characters'
    });

  return schema.validate(name);
}

export function validatePassword(password) {
  const schema = Joi.string()
    .min(7)
    .pattern(new RegExp('^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])'))
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least 1 uppercase letter, 1 number, and 1 special character',
      'string.min': 'Password must be at least 7 characters long',
      'string.empty': 'Password is required'
    });

  return schema.validate(password);
}