const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.stack);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: err.message, errors: err.errors });
  }

  if (err.code === '23505') {
    return res.status(409).json({ success: false, message: 'Duplicate entry - record already exists' });
  }

  if (err.code === '23503') {
    return res.status(400).json({ success: false, message: 'Referenced record not found' });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
};

module.exports = { errorHandler, notFound };
