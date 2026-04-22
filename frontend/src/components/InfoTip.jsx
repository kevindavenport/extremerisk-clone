import "./InfoTip.css";

export default function InfoTip({ text }) {
  return (
    <span className="infotip-wrapper">
      <span className="infotip-icon">ⓘ</span>
      <span className="infotip-bubble">{text}</span>
    </span>
  );
}
