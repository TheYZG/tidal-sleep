import { Timer } from './Timer';

export function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <div className="topbar__mark" />
        <div className="topbar__title">
          <span className="topbar__title-cn">潮汐眠境</span>
          <span className="topbar__title-en">Tidal Sleep</span>
        </div>
      </div>
      <Timer />
    </header>
  );
}
