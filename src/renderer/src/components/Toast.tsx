type ToastProps = {
  message: string;
};

export function Toast({ message }: ToastProps): JSX.Element | null {
  if (!message) return null;
  return <div className="toast">{message}</div>;
}
