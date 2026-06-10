export function validate(schema) {
  return (req, res, next) => {
    try {
      const data = schema.parse({ body: req.body, params: req.params, query: req.query });
      req.validated = data;
      next();
    } catch (e) {
      return res.status(400).json({ ok: false, message: "Validation failed", errors: e.errors || e });
    }
  };
}
