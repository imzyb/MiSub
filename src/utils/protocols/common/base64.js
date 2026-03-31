export function base64Encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
}
