import { NextResponse } from 'next/server';

// Script seguro para bloqueio de popups, overlays e anúncios
const blockScript = `
  (function() {
    'use strict';

    // --- 1. Bloqueio de Redirecionamentos e Pop-ups ---
    const preventRedirects = () => {
      try {
        Object.defineProperty(window, 'location', {
          value: window.location,
          writable: false,
          configurable: false,
          enumerable: true
        });
      } catch (e) {}
      window.open = function() { return null; };
      window.location.assign = function() {};
      window.location.replace = function() {};
      window.location.reload = function() {};
      if (window.history) {
        window.history.pushState = function() {};
        window.history.replaceState = function() {};
      }
      try { Object.defineProperty(window.parent, 'location', { writable: false, configurable: false }); } catch(e) {}
      try { Object.defineProperty(window.top, 'location', { writable: false, configurable: false }); } catch(e) {}
      document.querySelectorAll('meta[http-equiv="refresh"]').forEach(el => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
      const originalSetInterval = window.setInterval;
      window.setInterval = function(fn, t) {
        if (typeof fn === 'string' && fn.match(/location\\.|window\\.open|top\\.|parent\\.|eval\\(/i)) {
          console.warn('Bloqueado setInterval suspeito de redirecionamento:', fn);
          return null;
        }
        if (typeof fn === 'function' && fn.toString().match(/location\\.|window\\.open|top\\.|parent\\.|eval\\(/i)) {
          console.warn('Bloqueado setInterval suspeito de redirecionamento:', fn.toString());
          return null;
        }
        return originalSetInterval(fn, t);
      };
      ['beforeunload', 'unload'].forEach(eventType => {
        window.addEventListener(eventType, (e) => {
          e.stopImmediatePropagation();
          e.preventDefault();
          return false;
        }, true);
      });
    };

    // --- 2. Bloqueio de Anúncios e Elementos Obstrutivos ---
    const adSelectors = [
      '.ad', '.ads', '.advert', '.advertisement', '.ad-banner', '.ad-container', '.ad-slot', '.adbox', '.adunit', '.ad-wrapper',
      '.sponsor', '.sponsored', '.promo', '.promobox', '.google-ads', '.dfp-ad', '.banner-ad', '.ad-area', '.ad-leaderboard',
      '[id*="ad" i]', '[class*="ad" i]', '[id*="ads" i]', '[class*="ads" i]', '[id*="sponsor" i]', '[class*="sponsor" i]',
      '[id*="banner" i]', '[class*="banner" i]', '[id*="promo" i]', '[class*="promo" i]',
      'iframe[src*="doubleclick"]', 'iframe[src*="googlesyndication"]', 'iframe[src*="googleadservices"]',
      'iframe[src*="adnxs"]', 'iframe[src*="adform"]', 'iframe[src*="profitableratecpm"]',
      'iframe[src*="popads"]', 'iframe[src*="exoclick"]', 'iframe[src*="taboola"]',
      'iframe[src*="outbrain"]', 'iframe[src*="mgid"]', 'iframe[src*="adsterra"]',
      'iframe[src*="propellerads"]', 'iframe[src*="clickadu"]', 'iframe[src*="trafficjunky"]',
      'iframe[src*="adblade"]', 'iframe[src*="revcontent"]', 'iframe[src*="bidvertiser"]',
      'iframe[src*="adcash"]', 'iframe[src*="adf.ly"]', 'iframe[src*="shorte.st"]',
      'iframe[src*="linkvertise"]', 'iframe[src*="shortzon"]', 'iframe[src*="clk.sh"]',
      'iframe[src*="bc.vc"]', 'iframe[src*="ouo.io"]', 'iframe[src*="adfly"]',
      'iframe[src*="adclick"]', 'iframe[src*="adservice"]', 'iframe[src*="adtrack"]',
      'iframe[src*="adnetwork"]', 'iframe[src*="adserver"]', 'iframe[src*="adtech"]',
      'iframe[src*="adman"]', 'iframe[src*="admarketplace"]', 'iframe[src*="adroll"]',
      'iframe[src*="adscale"]', 'iframe[src*="adsense"]', 'iframe[src*="adwords"]',
      'iframe[src*="advertising"]', 'iframe[src*="advertserve"]', 'iframe[src*="advertstream"]',
      'iframe[src*="advertpro"]', 'iframe[src*="advert"]',
      '[id*="popup" i]', '[class*="popup" i]', '[id*="modal" i]', '[class*="modal" i]',
      '[id*="overlay" i]', '[class*="overlay" i]',
      '[id*="cookie-consent" i]', '[class*="cookie-consent" i]',
      '[aria-modal="true"]',
    ];

    // Heurística para nomes de classe/id ofuscados (ex: muitos caracteres aleatórios)
    function isObfuscated(str) {
      return str && str.length > 10 && /[a-zA-Z0-9]{8,}/.test(str) && /[a-z]/.test(str) && /[A-Z]/.test(str);
    }

    const removeElements = () => {
      adSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            if (el && el.parentNode) {
              console.log('[BLOQUEIO] Removendo por seletor:', selector, el.tagName, el.id || el.className);
              el.parentNode.removeChild(el);
            }
          });
        } catch (e) {
          console.error('Erro ao remover seletor:', selector, e);
        }
      });
      document.querySelectorAll('iframe').forEach(iframe => {
        if (iframe && iframe.src && !iframe.src.includes('player') && iframe.parentNode) {
            console.log('[BLOQUEIO] Removendo iframe não-player:', iframe.src);
            iframe.parentNode.removeChild(iframe);
        }
      });
      document.querySelectorAll('div, section, span, a, button').forEach(el => {
        try {
          const style = window.getComputedStyle(el);
          const w = el.offsetWidth, h = el.offsetHeight;
          const coversScreen = w > window.innerWidth * 0.8 && h > window.innerHeight * 0.8;
          const isHighZ = parseInt(style.zIndex, 10) > 9999;
          const isPointer = style.pointerEvents === 'auto' || style.pointerEvents === 'all';
          const isLowOpacity = style.opacity && parseFloat(style.opacity) < 0.2;
          const isObf = isObfuscated(el.className) || isObfuscated(el.id);
          // Remove overlays gigantes, opacos, pointer ativo, ou nomes ofuscados
          if (el.parentNode && (coversScreen && isHighZ && isPointer || isLowOpacity && isPointer || isObf && isPointer)) {
            console.log('[BLOQUEIO] Removendo overlay heurístico:', el.tagName, el.id || el.className);
            el.parentNode.removeChild(el);
          }
          // Remove elementos com onclick suspeito
          if (el.parentNode && el.onclick && el.onclick.toString().match(/ad|redirect|popup|window|location|open|click/i)) {
            console.log('[BLOQUEIO] Removendo elemento com onclick suspeito:', el.tagName, el.id || el.className);
            el.parentNode.removeChild(el);
          }
        } catch (e) {}
      });
      document.querySelectorAll('a').forEach(a => {
        try {
          const style = window.getComputedStyle(a);
          if (
            a.href &&
            (a.href.includes('profitableratecpm.com') || a.href.includes('outradomain.com')) &&
            style.position === 'fixed' &&
            parseInt(style.zIndex, 10) > 10000 &&
            style.width === '100%' &&
            style.height === '100%'
          ) {
            console.log('[BLOQUEIO] Removendo <a> suspeito:', a.href);
            a.parentNode && a.parentNode.removeChild(a);
          }
        } catch (e) {}
      });
      // Remover iframes e overlays ainda mais agressivamente
      document.querySelectorAll('iframe, div, section, span, a').forEach(el => {
        try {
          const style = window.getComputedStyle(el);
          const w = el.offsetWidth, h = el.offsetHeight;
          const coversScreen = w > window.innerWidth * 0.7 && h > window.innerHeight * 0.7;
          const isHighZ = parseInt(style.zIndex, 10) > 5000;
          const isPointer = style.pointerEvents === 'auto' || style.pointerEvents === 'all';
          const isLowOpacity = style.opacity && parseFloat(style.opacity) < 0.3;
          // Remove qualquer elemento grande, com z-index alto e pointer ativo
          if (el.parentNode && coversScreen && isHighZ && isPointer) {
            console.log('[BLOQUEIO AGRESSIVO] Removendo overlay/iframe:', el.tagName, el.id || el.className);
            el.parentNode.removeChild(el);
          }
          // Remove elementos grandes, opacos e pointer ativo
          if (el.parentNode && coversScreen && isLowOpacity && isPointer) {
            console.log('[BLOQUEIO AGRESSIVO] Removendo overlay opaco:', el.tagName, el.id || el.className);
            el.parentNode.removeChild(el);
          }
        } catch (e) {}
      });
    };

    // --- 3. Bloqueio agressivo de <a> overlays maliciosos e overlays dinâmicos ---
    function removeMaliciousLinks() {
      document.querySelectorAll('a').forEach(a => {
        try {
          const style = window.getComputedStyle(a);
          const href = a.getAttribute('href') || '';
          const isFixedOrAbs = style.position === 'fixed' || style.position === 'absolute';
          const isFullScreen = (parseInt(style.width) >= window.innerWidth * 0.9 || style.width.includes('100%')) &&
                               (parseInt(style.height) >= window.innerHeight * 0.9 || style.height.includes('100%'));
          const isHighZ = parseInt(style.zIndex) > 99999;
          const isPointer = style.pointerEvents === 'auto' || style.pointerEvents === 'all';
          const isLowOpacity = parseFloat(style.opacity) < 0.2;
          const isSuspectHref = href.includes('profitableratecpm.com') || href.includes('outradomain.com') || href.startsWith('http');
          if (
            isFixedOrAbs && isFullScreen && isHighZ && isPointer && isSuspectHref
          ) {
            console.log('[BLOQUEIO] <a> overlay removido:', href);
            a.parentNode && a.parentNode.removeChild(a);
          } else if (isLowOpacity && isSuspectHref) {
            console.log('[BLOQUEIO] <a> opaco removido:', href);
            a.parentNode && a.parentNode.removeChild(a);
          }
        } catch (e) {}
      });
    }
    removeMaliciousLinks();
    setInterval(removeMaliciousLinks, 500);
    const mo = new MutationObserver(removeMaliciousLinks);
    mo.observe(document.body, { childList: true, subtree: true });

    // --- 4. Execução e Observação do DOM ---
    const initializeBlocking = () => {
      preventRedirects();
      removeElements();
      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.addedNodes.length > 0) {
            removeElements();
          }
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
      let frameScheduled = false;
      const throttledRemoveElements = () => {
        if (!frameScheduled) {
          window.requestAnimationFrame(() => {
            removeElements();
            frameScheduled = false;
          });
          frameScheduled = true;
        }
      };
      setInterval(throttledRemoveElements, 200); // Executa a cada 200ms
      // Reforço: remove overlays sempre que o usuário clicar ou tocar na tela
      ['click', 'touchstart'].forEach(evt => {
        window.addEventListener(evt, removeElements, true);
      });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeBlocking);
    } else {
      initializeBlocking();
    }
  })();
  true;
`;

export async function GET(request: Request) {
  // Retorna apenas o script de bloqueio
  return NextResponse.json({ blockScript }, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
