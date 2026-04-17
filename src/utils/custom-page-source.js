export function parseCustomPageSource(content, css = '') {
  const rawContent = typeof content === 'string' ? content : '';
  const rawCss = typeof css === 'string' ? css : '';

  if (!rawContent.trim()) {
    return {
      html: '',
      css: rawCss,
      title: '',
      description: '',
      stylesheets: [],
      scripts: [],
      hadFullDocument: false,
      extractedStyles: false,
      strippedScripts: false
    };
  }

  if (typeof DOMParser === 'undefined') {
    return {
      html: rawContent,
      css: rawCss,
      title: '',
      description: '',
      stylesheets: [],
      scripts: [],
      hadFullDocument: /<!DOCTYPE|<html|<head|<body/i.test(rawContent),
      extractedStyles: false,
      strippedScripts: false
    };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawContent, 'text/html');
  const hadFullDocument = /<!DOCTYPE|<html|<head|<body/i.test(rawContent);
  const title = doc.querySelector('title')?.textContent?.trim() || '';
  const description = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';

  const styleBlocks = Array.from(doc.querySelectorAll('style')).map(node => node.textContent || '');
  const stylesheetLinks = Array.from(doc.querySelectorAll('link[rel~="stylesheet"]'))
    .map(node => node.getAttribute('href'))
    .filter(Boolean)
    .map(normalizeUrl);

  const linkImports = stylesheetLinks.map(href => `@import url("${href}");`);

  const scriptNodes = Array.from(doc.querySelectorAll('script'));
  const scripts = scriptNodes.map(node => ({
    src: node.getAttribute('src') ? normalizeUrl(node.getAttribute('src')) : '',
    content: node.textContent || ''
  }));
  const strippedScripts = scriptNodes.length > 0;
  scriptNodes.forEach(node => node.remove());

  doc.querySelectorAll('style, link[rel~="stylesheet"], meta, title').forEach(node => node.remove());

  const body = doc.body;
  const extractedCss = normalizeDocumentCss([...linkImports, ...styleBlocks, rawCss].filter(Boolean).join('\n\n'));
  const needsWrapper = hadFullDocument || body.attributes.length > 0 || /(^|[^\w-])(html|body|:root)(?=[^\w-]|$)/i.test(extractedCss);
  const html = needsWrapper
    ? wrapBodyContent(body)
    : body.innerHTML;

  return {
    html,
    css: extractedCss,
    title,
    description,
    stylesheets: stylesheetLinks,
    scripts,
    hadFullDocument,
    extractedStyles: styleBlocks.length > 0 || linkImports.length > 0,
    strippedScripts
  };
}

function normalizeUrl(value) {
  return String(value || '').trim().replace(/^http:\/\//i, 'https://');
}

function wrapBodyContent(body) {
  const attrs = [];
  const classes = ['custom-page-document', 'custom-page-html', 'custom-page-body'];

  Array.from(body.attributes).forEach(attr => {
    if (attr.name === 'class') {
      classes.push(...String(attr.value).split(/\s+/).filter(Boolean));
      return;
    }
    attrs.push(`${attr.name}="${escapeHtmlAttribute(attr.value)}"`);
  });

  return `<div class="${Array.from(new Set(classes)).join(' ')}" ${attrs.join(' ')}>${body.innerHTML}</div>`;
}

function normalizeDocumentCss(cssText) {
  if (!cssText.trim()) return '';

  return cssText
    .replace(/:root\b/g, '.custom-page-body')
    .replace(/(^|[\s,{>+~])html(?=($|[\s.#:[,{>+~]))/gm, '$1.custom-page-html')
    .replace(/(^|[\s,{>+~])body(?=($|[\s.#:[,{>+~]))/gm, '$1.custom-page-body');
}

function escapeHtmlAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
