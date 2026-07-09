import traceNestLogo from '../assets/tracenest-logo.png';

type TraceNestLogoProps = {
  className?: string;
};

export function TraceNestLogo({ className = '' }: TraceNestLogoProps): JSX.Element {
  return <img className={className} src={traceNestLogo} alt="图迹 TraceNest" draggable={false} />;
}
