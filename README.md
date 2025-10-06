# Synapse Link V5

**4개의 최첨단 AI 모델을 병렬로 실행하고 지식 그래프를 자동 생성하는 실시간 대시보드**

[![Vercel](https://img.shields.io/badge/Vercel-Production-000000?logo=vercel)](https://synapse-v5-nz88km5b1-uaf-c124f081.vercel.app/dashboard_aegis_v2.html)
[![Next.js](https://img.shields.io/badge/Next.js-15.5.4-000000?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)

---

## 🎯 주요 기능

### 1. 4개 AI Provider 병렬 처리
- **Gemini** (Google) - gemini-2.5-pro
- **Claude** (Anthropic) - claude-sonnet-4-5-20250929
- **Grok** (xAI) - grok-4
- **GPT-4o** (OpenAI) - gpt-4o

### 2. 실시간 SSE 스트리밍
- Server-Sent Events를 통한 실시간 응답
- 각 모델의 진행 상황을 실시간으로 모니터링
- Progress Bar 시각화

### 3. 지식 그래프 자동 생성
- 4개 모델의 응답을 자동으로 노드와 엣지로 변환
- JSON 형식으로 출력

### 4. 실시간 로그 모니터링
- 각 단계별 상세 로그
- 타임스탬프 포함
- 에러 및 완료 상태 표시

---

## 🚀 빠른 시작

### 환경 변수 설정

`.env.local` 파일을 생성하고 다음 API 키를 입력하세요:

```env
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GEMINI_API_KEY=your_gemini_api_key
XAI_API_KEY=your_xai_api_key
```

### 로컬 개발

```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev

# 브라우저에서 접속
open http://localhost:3000/dashboard_aegis_v2.html
```

---

## 📖 사용 방법

1. **프롬프트 입력**: 하단 입력창에 질문 입력
2. **실행 버튼 클릭**: 4개 모델이 병렬로 실행됨
3. **실시간 모니터링**: 각 모델의 진행 상황 확인
4. **결과 확인**: 지식 그래프 JSON 출력

---

## 🏗️ 프로젝트 구조

```
synapse-v5/
├── app/api/
│   ├── synapse/          # 메인 SSE API
│   ├── get-status/       # 상태 조회 API
│   └── update-status/    # 상태 업데이트 API
├── lib/orchestrator/
│   ├── providers/        # AI Provider 구현
│   └── graph.ts          # 지식 그래프 생성
├── public/
│   └── dashboard_aegis_v2.html  # 실시간 대시보드
└── fix-warnings.js       # 경고 자동 수정 스크립트
```

---

## 🛠️ 개발 도구

### 경고 자동 수정

```bash
npm run fix:warnings
```

### 린트 실행

```bash
npm run lint
```

---

## 🔗 링크

- **프로덕션**: https://synapse-v5-nz88km5b1-uaf-c124f081.vercel.app/dashboard_aegis_v2.html
- **GitHub**: https://github.com/yhun1542/synapse-link-v5

---

**Made with ❤️ by yhun1542**
