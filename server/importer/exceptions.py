"""
Typed error hierarchy for the import engine.

Every error carries a stable machine-readable ``code`` plus a message that is
safe to show to the admin in the UI.
"""


class ImporterError(Exception):
    code = 'IMPORT_FAILED'
    http_status = 400
    default_message = 'Import failed. Please try again.'

    def __init__(self, message=None, *, detail=None):
        self.message = message or self.default_message
        self.detail = detail
        super().__init__(self.message)

    def as_dict(self):
        payload = {'code': self.code, 'message': self.message}
        if self.detail:
            payload['detail'] = self.detail
        return payload


class InvalidUrlError(ImporterError):
    code = 'INVALID_URL'
    default_message = 'The URL is not valid. Paste a full product URL starting with http:// or https://.'


class BlockedUrlError(ImporterError):
    code = 'BLOCKED_URL'
    default_message = 'This URL points to a private or internal address and cannot be imported.'


class UnsupportedWebsiteError(ImporterError):
    code = 'UNSUPPORTED_WEBSITE'
    default_message = 'This website is not supported yet.'


class ProductNotFoundError(ImporterError):
    code = 'PRODUCT_NOT_FOUND'
    http_status = 404
    default_message = 'No product was found at this URL. Check that the link points to a product page.'


class ConnectionTimeoutError(ImporterError):
    code = 'CONNECTION_TIMEOUT'
    http_status = 504
    default_message = 'The website took too long to respond. Please try again in a moment.'


class BlockedRequestError(ImporterError):
    code = 'BLOCKED_REQUEST'
    http_status = 502
    default_message = 'The website blocked our request. Try again later or add the product manually.'


class FetchError(ImporterError):
    code = 'FETCH_FAILED'
    http_status = 502
    default_message = 'Could not download the product page. Please check the URL and try again.'


class ParsingError(ImporterError):
    code = 'PARSING_ERROR'
    http_status = 422
    default_message = 'The product page could not be read. The website layout may have changed.'


class MissingPriceError(ImporterError):
    code = 'MISSING_PRICE'
    http_status = 422
    default_message = 'No price could be found on the product page. You can still add the product manually.'


class ImageDownloadError(ImporterError):
    code = 'IMAGE_DOWNLOAD_FAILED'
    http_status = 502
    default_message = 'One or more product images could not be downloaded.'
