exports.getPagination = ({ page = 1, limit = 10 }) => {
  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));
  return { page: p, limit: l, skip: (p - 1) * l };
};

exports.pageMeta = (total, { page, limit }) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit) || 1,
});
