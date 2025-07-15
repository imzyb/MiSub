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
                const decodedSS = atob(mainPart);
                const ssDecodedAtIndex = decodedSS.indexOf('@');
                if (ssDecodedAtIndex !== -1) return decodedSS.substring(ssDecodedAtIndex + 1).split(':')[0] || '';
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
        if (protocolEndIndex === -1) throw new Error('无效的 URL：缺少协议头');

        const protocol = url.substring(0, protocolEndIndex);
        
        const fragmentStartIndex = url.indexOf('#');
        const mainPartEndIndex = fragmentStartIndex === -1 ? url.length : fragmentStartIndex;
        let mainPart = url.substring(protocolEndIndex + 3, mainPartEndIndex);

        // --- VMess 专用处理 ---
        if (protocol === 'vmess') {
            const decodedString = atob(mainPart);
            const nodeConfig = JSON.parse(decodedString);
            return { host: nodeConfig.add || '', port: String(nodeConfig.port || '') };
        }
        
        let decoded = false;
        // --- SS/SSR Base64 解码处理 ---
        if ((protocol === 'ss' || protocol === 'ssr') && mainPart.indexOf('@') === -1) {
            try {
                mainPart = atob(mainPart);
                decoded = true;
            } catch (e) { /* 解码失败则按原文处理 */ }
        }

        // --- SSR 解码后专门处理 ---
        if (protocol === 'ssr' && decoded) {
            const parts = mainPart.split(':');
            if (parts.length >= 2) {
                return { host: parts[0], port: parts[1] };
            }
        }
        
        // --- 通用解析逻辑 (适用于 VLESS, Trojan, SS原文, 解码后的SS等) ---
        const atIndex = mainPart.lastIndexOf('@');
        let serverPart = atIndex !== -1 ? mainPart.substring(atIndex + 1) : mainPart;

        const queryIndex = serverPart.indexOf('?');
        if (queryIndex !== -1) {
            serverPart = serverPart.substring(0, queryIndex);
        }
        const pathIndex = serverPart.indexOf('/');
        if (pathIndex !== -1) {
            serverPart = serverPart.substring(0, pathIndex);
        }

        const lastColonIndex = serverPart.lastIndexOf(':');
        
        if (serverPart.startsWith('[') && serverPart.includes(']')) {
            const bracketEndIndex = serverPart.lastIndexOf(']');
            const host = serverPart.substring(1, bracketEndIndex);
            if (lastColonIndex > bracketEndIndex) {
                 return { host, port: serverPart.substring(lastColonIndex + 1) };
            }
            return { host, port: '' };
        }

        if (lastColonIndex !== -1) {
            const potentialHost = serverPart.substring(0, lastColonIndex);
            const potentialPort = serverPart.substring(lastColonIndex + 1);
            if (potentialHost.includes(':')) { // 处理无端口的 IPv6
                return { host: serverPart, port: '' };
            }
            return { host: potentialHost, port: potentialPort };
        }
        
        if (serverPart) {
            return { host: serverPart, port: '' };
        }

        throw new Error('自定义解析失败');

    } catch (e) {
        console.error("提取主机和端口失败:", url, e);
        return { host: '解析失败', port: 'N/A' };
    }
}