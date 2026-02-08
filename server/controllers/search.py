"""Search controller — Google search, open URLs."""

import webbrowser
import urllib.parse


class SearchController:
    def google_search(self, query: str = "", **_):
        """Open a Google search in the default browser."""
        if not query:
            return {"error": "No query provided"}
        encoded = urllib.parse.quote_plus(query)
        url = f"https://www.google.com/search?q={encoded}"
        webbrowser.open(url)
        return {"searched": query}

    def open_url(self, url: str = "", **_):
        """Open a URL in the default browser."""
        if not url:
            return {"error": "No URL provided"}
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        webbrowser.open(url)
        return {"opened": url}
