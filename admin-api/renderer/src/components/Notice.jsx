export default function Notice({ children }) {
  if (!children) {
    return null;
  }

  return <div className="notice">{children}</div>;
}
