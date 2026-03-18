#!/usr/bin/env node

/**
 * Sidecar 构建脚本
 * 使用 pkg 将 Node.js 后端打包为独立可执行文件
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 配置
const CONFIG = {
    entryPoint: 'src/server/index.ts',
    outputDir: 'src-tauri/binaries',
    targets: [
        'node18-win-x64',
        'node18-macos-x64',
        'node18-macos-arm64',
        'node18-linux-x64',
    ],
    binaryName: 'ai-mahjong-server',
};

// 确保输出目录存在
function ensureOutputDir() {
    const outputDir = path.resolve(CONFIG.outputDir);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`Created output directory: ${outputDir}`);
    }
}

// 先编译 TypeScript
function compileTypeScript() {
    console.log('Compiling TypeScript...');
    execSync('npx tsc --outDir dist/server', { stdio: 'inherit' });
    console.log('TypeScript compiled successfully');
}

// 使用 pkg 打包
function buildWithPkg() {
    console.log('Building with pkg...');
    
    for (const target of CONFIG.targets) {
        console.log(`Building for ${target}...`);
        
        const outputPath = path.join(
            CONFIG.outputDir,
            `${CONFIG.binaryName}-${getTargetSuffix(target)}`
        );
        
        try {
            execSync(`npx pkg dist/server/index.js --target ${target} --output ${outputPath}`, {
                stdio: 'inherit',
            });
            console.log(`Built: ${outputPath}`);
        } catch (error) {
            console.error(`Failed to build for ${target}:`, error.message);
        }
    }
}

// 获取目标平台后缀
function getTargetSuffix(target) {
    const map = {
        'node18-win-x64': 'x86_64-pc-windows-msvc.exe',
        'node18-macos-x64': 'x86_64-apple-darwin',
        'node18-macos-arm64': 'aarch64-apple-darwin',
        'node18-linux-x64': 'x86_64-unknown-linux-gnu',
    };
    return map[target] || target;
}

// 主函数
async function main() {
    console.log('=== Sidecar Build Script ===\n');
    
    ensureOutputDir();
    compileTypeScript();
    buildWithPkg();
    
    console.log('\n=== Build Complete ===');
}

main().catch(console.error);
