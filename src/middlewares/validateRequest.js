/**
 * Middleware to validate request data using Zod schemas
 */
export const validateRequest = (schema) => {
  return async (req, res, next) => {
    try {
      // Validate request body, query, and params
      const validated = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Replace req data with validated data
      req.body = validated.body || req.body;
      req.query = validated.query || req.query;
      req.params = validated.params || req.params;

      next();
    } catch (error) {
      next(error);
    }
  };
};
