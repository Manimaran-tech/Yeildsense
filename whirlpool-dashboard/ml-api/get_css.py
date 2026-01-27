
import requests
from bs4 import BeautifulSoup
import sys

def get_css_links(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(url, headers=headers)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        css_links = []
        for link in soup.find_all('link', rel='stylesheet'):
            href = link.get('href')
            if href:
                # Handle relative URLs if necessary (though usually absolute on these sites)
                if not href.startswith('http'):
                    if href.startswith('//'):
                        href = 'https:' + href
                    else:
                        href = url.rstrip('/') + '/' + href.lstrip('/')
                css_links.append(href)
        return css_links
    except Exception as e:
        print(f"Error: {e}")
        return []

if __name__ == "__main__":
    url = "https://landonorris.com/"
    links = get_css_links(url)
    print(f"Found {len(links)} CSS files:")
    for link in links:
        print(link)
