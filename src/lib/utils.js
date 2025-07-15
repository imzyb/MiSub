//
// src/lib/utils.js
//
export function extractNodeName(url) {
    if (!url) return '';
    url = url.trim();
    try {
        const hashIndex = url.indexOf('#');
        if (hashIndex !== -1 && hashIndex < url.length - 1) {
            return decodeURIComponent(url.substring(hashIndex + 1)).trim();
        }
        const protocolIndex = url.indexOf('://');
        if (protocolIndex === -1) return '';
        const protocol = url.substring(0, protocolIndex);
        const mainPart = url.substring(protocolIndex + 3).split('#')[0];
        switch (protocol) {
            case 'vmess': {
                // 修正：使用现代方法正确解码包含UTF-8字符的Base64
                let padded = mainPart.padEnd(mainPart.length + (4 - mainPart.length % 4) % 4, '=');
                let ps = '';
                try {
                    // 1. 使用 atob 将 Base64 解码为二进制字符串
                    const binaryString = atob(padded);
                    
                    // 2. 将二进制字符串转换为 Uint8Array 字节数组
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    
                    // 3. 使用 TextDecoder 将字节解码为正确的 UTF-8 字符串
                    const jsonString = new TextDecoder('utf-8').decode(bytes);
                    
                    // 4. 解析 JSON
                    const node = JSON.parse(jsonString);
                    
                    // 5. 直接获取节点名称，此时已是正确解码的字符串，无需再次处理
                    ps = node.ps || '';
                } catch (e) {
                    // 如果解码失败，可以保留一个回退逻辑，或者直接返回空字符串
                    console.error("Failed to decode vmess link:", e);
                }
                return ps;
            }
            case 'trojan':
            case 'vless': return mainPart.substring(mainPart.indexOf('@') + 1).split(':')[0] || '';
            case 'ss':
                const atIndexSS = mainPart.indexOf('@');
                if (atIndexSS !== -1) return mainPart.substring(atIndexSS + 1).split(':')[0] || '';
                // If no @, try to decode as Base64, but only if it looks like Base64
                const isBase64SS = /^[A-Za-z0-9+/=]+$/.test(mainPart);
                if (isBase64SS) {
                    try {
                        const decodedSS = atob(mainPart);
                        const ssDecodedAtIndex = decodedSS.indexOf('@');
                        if (ssDecodedAtIndex !== -1) return decodedSS.substring(ssDecodedAtIndex + 1).split(':')[0] || '';
                    } catch (e) {
                        console.error("Failed to decode SS link (atob error):", e);
                    }
                }
                return '';
            default:
                if(url.startsWith('http')) return new URL(url).hostname;
                return '';
        }
    } catch (e) { return url.substring(0, 50); }
}


/**
 * 为节点链接添加名称前缀
 * @param {string} link - 原始节点链接
 * @param {string} prefix - 要添加的前缀 (通常是订阅名)
 * @returns {string} - 添加了前缀的新链接
 */
export function prependNodeName(link, prefix) {
  if (!prefix) return link; // 如果没有前缀，直接返回原链接

  const hashIndex = link.lastIndexOf('#');
  
  // 如果链接没有 #fragment
  if (hashIndex === -1) {
    return `${link}#${encodeURIComponent(prefix)}`;
  }

  const baseLink = link.substring(0, hashIndex);
  const originalName = decodeURIComponent(link.substring(hashIndex + 1));
  
  // 如果原始名称已经包含了前缀，则不再重复添加
  if (originalName.startsWith(prefix)) {
      return link;
  }

  const newName = `${prefix} - ${originalName}`;
  return `${baseLink}#${encodeURIComponent(newName)}`;
}

/**
 * [新增] 从节点链接中提取主机和端口
 * @param {string} url - 节点链接
 * @returns {{host: string, port: string}}
 */
export function extractHostAndPort(url) {
    if (!url) return { host: '', port: '' };

    try {
        const protocolEndIndex = url.indexOf('://');
        if (protocolEndIndex === -1) return { host: '', port: '' };

        const protocol = url.substring(0, protocolEndIndex);

        const fragmentStartIndex = url.indexOf('#');
        const mainPartEndIndex = fragmentStartIndex === -1 ? url.length : fragmentStartIndex;
        
        let mainPart = url.substring(protocolEndIndex + 3, mainPartEndIndex);

        // --- VMESS 专用处理逻辑 ---
        if (protocol === 'vmess') {
            try {
                const queryIndexVmess = mainPart.indexOf('?');
                const base64Part = queryIndexVmess !== -1 ? mainPart.substring(0, queryIndexVmess) : mainPart;

                // Add a check if base64Part looks like Base64
                const isBase64 = /^[A-Za-z0-9+/=]+$/.test(base64Part);
                if (!isBase64) {
                    // If not Base64, it's a malformed vmess link.
                    // Try to extract host/port directly if it's in host:port format.
                    const parts = base64Part.split(':');
                    if (parts.length === 2) {
                        return { host: parts[0], port: parts[1] };
                    }
                    return { host: '', port: '' }; // Cannot parse
                }

                const decodedString = atob(base64Part);
                const nodeConfig = JSON.parse(decodedString);

                const host = nodeConfig.add || '';
                const port = nodeConfig.port ? String(nodeConfig.port) : '';
                return { host, port };
            } catch (e) {
                console.error("Failed to decode VMess URL (atob or JSON parse error):", url, e);
                // Fallback for malformed vmess links that are not Base64 JSON
                const parts = mainPart.split(':');
                if (parts.length === 2) {
                    return { host: parts[0], port: parts[1] };
                }
                return { host: '', port: '' };
            }
        }

        // --- SS/SSR Base64 处理 ---
        if (protocol === 'ss' || protocol === 'ssr') {
             // Only attempt atob if it looks like a Base64 string
             const isBase64SS = /^[A-Za-z0-9+/=]+$/.test(mainPart);
             if (mainPart.indexOf('@') === -1 && isBase64SS) {
                try {
                    mainPart = atob(mainPart);
                } catch(e) { 
                    console.error("Failed to decode SS/SSR link (atob error):", e);
                    /* 不是有效的 Base64，按原样处理 */ 
                }
             }
        }
        
        // --- 通用解析逻辑 (适用于 VLESS, Trojan, Socks5, SS/SSR 等) ---

        // 1. 分离用户认证信息和服务器信息
        const atIndex = mainPart.lastIndexOf('@');
        let serverPart = atIndex !== -1 ? mainPart.substring(atIndex + 1) : mainPart;

        // 2. 移除查询参数 (?...) 和路径 (/...)
        const queryIndex = serverPart.indexOf('?');
        if (queryIndex !== -1) {
            serverPart = serverPart.substring(0, queryIndex);
        }
        const pathIndex = serverPart.indexOf('/');
        if (pathIndex !== -1) {
            serverPart = serverPart.substring(0, pathIndex);
        }
        
        // 3. 解析 Host 和 Port，兼容 IPv6
        const lastColonIndex = serverPart.lastIndexOf(':');
        const lastBracketIndex = serverPart.lastIndexOf(']');

        let host = '';
        let port = '';

        // 处理 IPv6 地址 [address]:port
        if (serverPart.startsWith('[') && lastBracketIndex > 0 && lastColonIndex > lastBracketIndex) {
            host = serverPart.substring(1, lastBracketIndex);
            port = serverPart.substring(lastColonIndex + 1);
        } else if (lastColonIndex !== -1) { // 处理 IPv4 或域名 host:port
            host = serverPart.substring(0, lastColonIndex);
            port = serverPart.substring(lastColonIndex + 1);
        } else { // 只有 Host，没有 Port
            host = serverPart;
        }
        
        return { host, port };

    } catch (e) {
        console.error("提取主机和端口失败:", url, e);
        return { host: '', port: '' };
    }
}