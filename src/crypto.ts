import { createHash, createHmac, createDecipheriv, timingSafeEqual } from "node:crypto";

/**
 * WPS协作加解密工具
 */

export function calculateContentMd5(content: string): string {
  if (!content) {
    return "d41d8cd98f00b204e9800998ecf8427e";
  }
  return createHash("md5").update(content, "utf8").digest("hex");
}

export function md5Hex(content: string): string {
  return createHash("md5").update(content, "utf8").digest("hex");
}

export function getRFC1123Date(): string {
  return new Date().toUTCString();
}

/**
 * 安全的字符串比较（防止时序攻击）
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  try {
    return timingSafeEqual(
      Buffer.from(a, "utf8"),
      Buffer.from(b, "utf8")
    );
  } catch {
    return false;
  }
}

export function calculateKSO1Signature(
  method: string,
  requestURI: string,
  contentType: string,
  ksoDate: string,
  requestBody: string,
  secretKey: string
): string {
  let sha256Hex = "";
  if (requestBody && requestBody.length > 0) {
    sha256Hex = createHash("sha256").update(requestBody, "utf8").digest("hex");
  }

  const signContent = "KSO-1" + method + requestURI + contentType + ksoDate + sha256Hex;
  const signature = createHmac("sha256", secretKey)
    .update(signContent, "utf8")
    .digest("hex");

  return signature;
}

/**
 * 生成完整的 KSO-1 Authorization Header
 */
export function generateKSO1AuthHeader(
  appId: string,
  method: string,
  requestURI: string,
  contentType: string,
  ksoDate: string,
  requestBody: string,
  secretKey: string
): string {
  const signature = calculateKSO1Signature(
    method,
    requestURI,
    contentType,
    ksoDate,
    requestBody,
    secretKey
  );
  
  return `KSO-1 ${appId}:${signature}`;
}

export function verifyKSO1Signature(
  authHeader: string,
  ksoDate: string,
  method: string,
  requestURI: string,
  contentType: string,
  requestBody: string,
  expectedAccessKey: string,
  secretKey: string
): boolean {
  try {
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "KSO-1") {
      return false;
    }

    const [accessKey, providedSignature] = parts[1].split(":");
    if (!accessKey || !providedSignature) {
      return false;
    }

    // 使用安全比较防止时序攻击
    if (!safeCompare(accessKey, expectedAccessKey)) {
      return false;
    }

    const expectedSignature = calculateKSO1Signature(
      method,
      requestURI,
      contentType,
      ksoDate,
      requestBody,
      secretKey
    );

    // 使用安全比较防止时序攻击
    return safeCompare(providedSignature, expectedSignature);
  } catch (error) {
    return false;
  }
}

export function calculateWPS3Signature(
  appId: string,
  secretKey: string,
  contentMd5: string,
  requestUri: string,
  contentType: string,
  date: string
): string {
  const hash = createHash("sha1");
  hash.update(secretKey.toLowerCase());
  hash.update(contentMd5);
  hash.update(requestUri);
  hash.update(contentType);
  hash.update(date);
  
  const signature = hash.digest("hex");
  return `WPS-3:${appId}:${signature}`;
}

export function calculateEventSignature(
  appId: string,
  secretKey: string,
  topic: string,
  nonce: string,
  time: number,
  encryptedData: string
): string {
  const content = `${appId}:${topic}:${nonce}:${time}:${encryptedData}`;
  const hmac = createHmac("sha256", secretKey);
  hmac.update(content, "utf8");
  
  const signature = hmac.digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  
  return signature;
}

export function verifyEventSignature(
  appId: string,
  secretKey: string,
  topic: string,
  nonce: string,
  time: number,
  encryptedData: string,
  receivedSignature: string
): boolean {
  try {
    // 验证时间戳（防止重放攻击）
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentTime - time);
    
    // 允许 5 分钟的时间偏差
    if (timeDiff > 300) {
      console.warn("[crypto] Event timestamp too old or too new:", timeDiff, "seconds");
      return false;
    }

    const expectedSignature = calculateEventSignature(
      appId,
      secretKey,
      topic,
      nonce,
      time,
      encryptedData
    );
    
    // 使用安全比较防止时序攻击
    return safeCompare(expectedSignature, receivedSignature);
  } catch (error) {
    return false;
  }
}

export function decryptEventData(
  secretKey: string,
  encryptedData: string,
  nonce: string
): string {
  // 参数验证
  if (!secretKey || !encryptedData || !nonce) {
    throw new Error("解密参数不完整");
  }

  try {
    // Base64 解码
    const encryptedBuffer = Buffer.from(encryptedData, "base64");

    // 使用 MD5(secretKey) 作为密钥 - MD5 产生 16 字节 (128位) 密钥
    const cipherHex = md5Hex(secretKey);
    const keyBuffer = Buffer.from(cipherHex, "hex");

    // 检查密钥长度 - MD5 是 16 字节
    if (keyBuffer.length !== 16) {
      throw new Error(`密钥长度错误: ${keyBuffer.length} (期望: 16)`);
    }

    // 根据官方文档，nonce 就是 IV 向量（直接使用，不进行 hex 解析）
    // nonce 是字符串，转换为 Buffer 作为 IV
    const ivBuffer = Buffer.from(nonce, "utf8");

    // 确保 IV 长度为 16
    if (ivBuffer.length < 16) {
      throw new Error(`IV 长度不足: ${ivBuffer.length} (期望: 16)`);
    }

    // 如果超过 16，截取前 16 字节
    const finalIv = ivBuffer.length > 16 ? ivBuffer.slice(0, 16) : ivBuffer;

    console.log("[DEBUG] 解密参数:");
    console.log(`  密钥 (hex): ${cipherHex}`);
    console.log(`  密钥长度: ${keyBuffer.length} bytes`);
    console.log(`  IV 长度: ${finalIv.length} bytes`);
    console.log(`  IV (hex): ${finalIv.toString("hex")}`);
    console.log(`  Nonce: ${nonce}`);
    console.log(`  Nonce (hex): ${Buffer.from(nonce, "utf8").toString("hex")}`);
    console.log(`  Nonce 原始长度: ${nonce.length} 字符`);
    console.log(`  非常规解密尝试...`);

    // 尝试多种解密方式
    let decrypted: Buffer | null = null;
    let errorMessages: string[] = [];

    // 方式 1: 直接使用 nonce 的 UTF8 作为 IV（官方文档做法）
    try {
      const decipher1 = createDecipheriv("aes-128-cbc", keyBuffer, finalIv);
      decipher1.setAutoPadding(true);
      decrypted = Buffer.concat([
        decipher1.update(encryptedBuffer),
        decipher1.final()
      ]);
      console.log("[DEBUG] 方式 1 成功");
      return decrypted.toString("utf8");
    } catch (e) {
      errorMessages.push(`方式 1 失败: ${e}`);
    }

    // 方式 2: 将 nonce 作为 hex 编码解析（如果它是十六进制字符串）
    if (nonce.length >= 32) {
      try {
        const ivFromHex = Buffer.from(nonce.slice(0, 32), "hex");
        const decipher2 = createDecipheriv("aes-128-cbc", keyBuffer, ivFromHex);
        decipher2.setAutoPadding(true);
        decrypted = Buffer.concat([
          decipher2.update(encryptedBuffer),
          decipher2.final()
        ]);
        console.log("[DEBUG] 方式 2 成功");
        return decrypted.toString("utf8");
      } catch (e) {
        errorMessages.push(`方式 2 失败: ${e}`);
      }
    }

    // 方式 3: 使用 nonce 重复填充到 16 字节
    if (nonce.length < 16) {
      const paddedNonce = (nonce + nonce.repeat(16)).slice(0, 16);
      try {
        const ivPadded = Buffer.from(paddedNonce, "utf8");
        const decipher3 = createDecipheriv("aes-128-cbc", keyBuffer, ivPadded);
        decipher3.setAutoPadding(true);
        decrypted = Buffer.concat([
          decipher3.update(encryptedBuffer),
          decipher3.final()
        ]);
        console.log("[DEBUG] 方式 3 成功");
        return decrypted.toString("utf8");
      } catch (e) {
        errorMessages.push(`方式 3 失败: ${e}`);
      }
    }

    // 所有方式都失败
    console.error("[ERROR] 所有解密方式都失败:");
    errorMessages.forEach((msg, i) => console.error(`  ${i + 1}. ${msg}`));

    throw new Error(`解密失败: 所有尝试都失败。请检查密钥和 nonce 是否正确`);
  } catch (error) {
    throw new Error(`解密失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}
