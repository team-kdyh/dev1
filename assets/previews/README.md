# M0 플레이스홀더 검토 시트

`placeholder-contact-sheet.png`와 `silhouette-contact-sheet.png`는 이전 M0 임시 에셋, `unit-art-contact-sheet.png`와 `unit-art-silhouette-sheet.png`는 현재 패킹 중인 제품형 유닛 16종·인물 보스 2종이다. 왼쪽부터 T1~T9, 첫 줄 세미콘, 둘째 줄 오차드. 현재 게임의 데스크톱·모바일 전투 화면은 `game-generated-*.png`와 [게임 UI 미리보기](../game-ui/index.html)에서 볼 수 있다.

검토할 때 같은 티어의 두 진영과 인접 티어의 실루엣을 비교하고, 제품 형태가 흐려지면 카메라·힌지·펜·바이저 등 큰 특징을 먼저 수정한다. 실제 제품 참조는 [참조표](../model-references.md)에 있다.

`index.html`에서는 아틀라스의 애니메이션, trim/앵커, 좌우 반전을 미리 볼 수 있다. 파일을 브라우저에서 직접 열어도 된다. `preview-data.js`는 `python3 assets/tools/pack_assets.py`를 실행할 때 manifest와 아틀라스 JSON에서 자동 갱신된다.

`photo-animation-gallery.html`에서는 T1~T8의 원본 제품 사진, T9의 인물 참조 사진과 아틀라스 애니메이션을 나란히 비교할 수 있다. 서버 없이 파일을 직접 열 수 있다.

T9 두 보스는 각각 이재용·스티브 잡스 인물 캐릭터다. 보스 애니메이션에는 제품 사진이 없다.
