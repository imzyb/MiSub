const regex = /\{([a-zA-Z0-9_]+)(?::([a-zA-Z0-9]+))?\}/g;
const template = '{emoji}{region}-{protocol}-{index:2}';
const vars = { emoji: '🇭🇰', region: '香港', protocol: 'hysteria2', index: '1' };

const result = template.replace(regex, (match, key, modifier) => {
    console.log(`Match: ${match}, Key: ${key}, Modifier: ${modifier}`);
    let v = vars[key];
    if (v === undefined) return '';
    return v;
});

console.log('Final Result:', result);
