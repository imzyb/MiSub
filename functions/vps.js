export async function onRequest(context) {

    const response = await context.next();

    const contentType = response.headers.get("Content-Type") || "";
    if (!contentType.includes("text/html")) {
        return response;
    }

    let html = await response.text();
    const customMeta = `
    <title>MiSub</title>
    <meta property="og:title" content="MiSub - Monitor" />
    <meta property="og:description" content="一个全新的探针系统" />
    <meta property="og:site_name" content="MiSub" />
  `;

    html = html.replace('<title>MISUB</title>', customMeta);

    return new Response(html, response);
}