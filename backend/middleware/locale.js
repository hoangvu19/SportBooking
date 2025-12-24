const { getLocaleFromReq, t } = require('../i18n/translator');

function localeMiddleware(req, res, next) {
  try {
    const locale = getLocaleFromReq(req) || 'vi';
    res.locals.locale = locale;
    req.lang = locale;
    req.t = (key, params) => t(key, locale, params);
    res.t = req.t;
  } catch (err) {
    res.locals.locale = 'vi';
    req.lang = 'vi';
    req.t = (k) => k;
    res.t = req.t;
  }
  next();
}

module.exports = localeMiddleware;
