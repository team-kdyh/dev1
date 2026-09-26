import type { HeadlessAdapter } from '../types.js';

export function createProjectAdapter(): HeadlessAdapter {
  throw new Error(
    '트랙 B의 headless 러너가 아직 연결되지 않았습니다. HeadlessAdapter를 구현한 모듈을 --adapter <module-path>로 전달하거나, 도구 점검만 하려면 --adapter smoke를 사용하세요.'
  );
}
