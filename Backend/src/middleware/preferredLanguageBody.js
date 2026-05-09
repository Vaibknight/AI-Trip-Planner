const { resolvePreferredLanguage } = require('../utils/preferredLanguage');

/**
 * Canonicalize preferred language on the request body (trim, BCP-47 → ISO 639-1).
 * Merges optional `language` and `locale` so `locale: "de-DE"` alone still yields `de`.
 * Run before validators that check `isIn` against supported codes.
 */
function preferredLanguageBody(req, res, next) {
  if (req.body && (req.body.preferredLanguage != null
    || req.body.language != null
    || req.body.locale != null)) {
    req.body.preferredLanguage = resolvePreferredLanguage({
      preferredLanguage: req.body.preferredLanguage,
      language: req.body.language,
      locale: req.body.locale
    });
  }
  next();
}

module.exports = { preferredLanguageBody };
