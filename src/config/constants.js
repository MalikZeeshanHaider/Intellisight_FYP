export const PERSON_TYPES = {
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
};

export const ADMIN_ROLES = {
  SUPER_ADMIN: 'Super Admin',
  MANAGER: 'Manager',
  COORDINATOR: 'Coordinator',
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
};

export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Validation error',
  INTERNAL_ERROR: 'Internal server error',
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_EXISTS: 'Email already exists',
  TOKEN_REQUIRED: 'Authentication token required',
  INVALID_TOKEN: 'Invalid or expired token',
};

export const SUCCESS_MESSAGES = {
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  LOGIN_SUCCESS: 'Login successful',
  REGISTER_SUCCESS: 'Registration successful',
  ENTRY_RECORDED: 'Entry recorded successfully',
  EXIT_RECORDED: 'Exit recorded successfully',
};
