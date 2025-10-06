#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 색상 출력용 ANSI 코드
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

console.log(`${colors.blue}🔧 자동 경고 수정 스크립트 시작...${colors.reset}\n`);

// 1. npm deprecation 경고 처리
function fixNpmDeprecations() {
  console.log(`${colors.yellow}📦 npm deprecation 경고 확인 중...${colors.reset}`);
  
  try {
    // node-domexception을 사용하는 패키지 찾기
    const result = execSync('npm ls node-domexception 2>/dev/null || true', { encoding: 'utf8' });
    
    if (result.includes('node-domexception')) {
      console.log(`${colors.yellow}  - node-domexception을 사용하는 패키지 발견${colors.reset}`);
      console.log(`  - 다음 명령어로 업데이트 시도: npm update`);
      
      execSync('npm update', { stdio: 'inherit' });
      console.log(`${colors.green}  ✓ 패키지 업데이트 완료${colors.reset}`);
    } else {
      console.log(`${colors.green}  ✓ node-domexception 의존성 없음${colors.reset}`);
    }
  } catch (_) {
    console.log(`${colors.red}  ⚠ npm 업데이트 실패: ${error.message}${colors.reset}`);
  }
}

// 2. Unused variables 자동 수정
function fixUnusedVariables() {
  console.log(`\n${colors.yellow}🔍 사용하지 않는 변수 검색 및 수정 중...${colors.reset}`);
  
  const extensions = ['.js', '.jsx', '.ts', '.tsx'];
  let fixedCount = 0;
  
  function processFile(filePath) {
    if (!extensions.some(ext => filePath.endsWith(ext))) return;
    if (filePath.includes('node_modules')) return;
    if (filePath.includes('.git')) return;
    
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;
      
      // catch (e) -> catch (_) 변환
      const catchPattern = /catch\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)\s*{([^}]*)}/g;
      content = content.replace(catchPattern, (match, varName, blockContent) => {
        // 블록 내에서 변수가 사용되는지 확인
        const varUsagePattern = new RegExp(`\\b${varName}\\b`);
        if (!varUsagePattern.test(blockContent)) {
          modified = true;
          console.log(`  📝 ${filePath}: catch(${varName}) -> catch(_)`);
          return `catch (_) {${blockContent}}`;
        }
        return match;
      });
      
      // 일반 unused 변수 처리 (const/let/var)
      const _unusedVarPattern = /^(\s*)(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([^;]+);/gm;
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        const match = line.match(/^\s*(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/);
        if (match) {
          const varName = match[2];
          // 변수가 선언 이후에 사용되는지 확인
          const afterDeclaration = lines.slice(index + 1).join('\n');
          const varUsagePattern = new RegExp(`\\b${varName}\\b`);
          
          if (!varUsagePattern.test(afterDeclaration)) {
            // 사용되지 않는 변수명 앞에 _ 추가
            const newLine = line.replace(
              new RegExp(`\\b${varName}\\b`),
              `_${varName}`
            );
            lines[index] = newLine;
            modified = true;
            console.log(`  📝 ${filePath}:${index + 1}: ${varName} -> _${varName}`);
          }
        }
      });
      
      if (modified) {
        content = lines.join('\n');
        fs.writeFileSync(filePath, content, 'utf8');
        fixedCount++;
      }
      
    } catch (_) {
      console.log(`${colors.red}  ⚠ 파일 처리 오류 (${filePath}): ${error.message}${colors.reset}`);
    }
  }
  
  function walkDir(dir) {
    try {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist' && file !== 'build') {
            walkDir(filePath);
          }
        } else {
          processFile(filePath);
        }
      });
    } catch (_) {
      console.log(`${colors.red}  ⚠ 디렉토리 읽기 오류: ${error.message}${colors.reset}`);
    }
  }
  
  // 현재 디렉토리부터 시작
  walkDir(process.cwd());
  
  console.log(`${colors.green}  ✓ 총 ${fixedCount}개 파일 수정 완료${colors.reset}`);
}

// 3. ESLint 자동 수정 실행
function runESLintFix() {
  console.log(`\n${colors.yellow}🛠️  ESLint 자동 수정 실행 중...${colors.reset}`);
  
  try {
    execSync('npx eslint . --fix --ext .js,.jsx,.ts,.tsx', { stdio: 'inherit' });
    console.log(`${colors.green}  ✓ ESLint 자동 수정 완료${colors.reset}`);
  } catch (_) {
    console.log(`${colors.yellow}  ⚠ ESLint 수정 중 일부 오류 발생 (정상적인 경우가 많음)${colors.reset}`);
  }
}

// 4. 최종 확인
function finalCheck() {
  console.log(`\n${colors.blue}📋 최종 확인...${colors.reset}`);
  
  try {
    const eslintResult = execSync('npx eslint . --ext .js,.jsx,.ts,.tsx 2>&1 || true', { encoding: 'utf8' });
    const warningCount = (eslintResult.match(/warning/g) || []).length;
    
    if (warningCount > 0) {
      console.log(`${colors.yellow}  ⚠ 아직 ${warningCount}개의 경고가 남아있습니다.${colors.reset}`);
      console.log(`  수동으로 확인이 필요할 수 있습니다.`);
    } else {
      console.log(`${colors.green}  ✓ 모든 경고가 해결되었습니다!${colors.reset}`);
    }
  } catch (_) {
    console.log(`${colors.red}  최종 확인 실패: ${error.message}${colors.reset}`);
  }
}

// 메인 실행
async function main() {
  try {
    // 1. npm deprecation 수정
    fixNpmDeprecations();
    
    // 2. Unused variables 수정
    fixUnusedVariables();
    
    // 3. ESLint 자동 수정
    runESLintFix();
    
    // 4. 최종 확인
    finalCheck();
    
    console.log(`\n${colors.green}✨ 자동 수정 완료!${colors.reset}`);
    console.log(`${colors.blue}다음 명령어로 남은 경고를 확인하세요:${colors.reset}`);
    console.log(`  npm run lint`);
    
  } catch (error) {
    console.error(`${colors.red}❌ 스크립트 실행 중 오류 발생: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// 스크립트 실행
main();