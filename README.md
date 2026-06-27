# 4000 Essential English Words 2 Test

GitHub Pages로 배포하는 모바일용 영단어 시험 대시보드입니다.

## Local Preview

```powershell
.\.venv\Scripts\Activate.ps1
python -m http.server 4173 --directory docs
```

브라우저에서 `http://127.0.0.1:4173/`를 엽니다.

## Data

- 원본 OCR PDF는 `문서/4000 Essential English Words 2 PDF.pdf`에 로컬로 둡니다.
- GitHub에는 PDF를 올리지 않습니다.
- 시험 범위는 교재 페이지(`bookPage`) 기준입니다.
- 단원 선택은 목차의 단어 목록 페이지로 변환한 뒤 페이지 기준으로 출제합니다.
- 단어 데이터 재생성:

```powershell
.\.venv\Scripts\python.exe tools\extract_words.py
```

`docs/data/words.json`은 앱에서 사용하는 단어 데이터이고, `docs/data/toc.json`은 목차/페이지 범위 데이터입니다. `data/words-review.csv`는 OCR 검수용입니다.

## GitHub Pages

저장소 Settings -> Pages에서 다음처럼 설정합니다.

- Source: Deploy from a branch
- Branch: main
- Folder: /docs
