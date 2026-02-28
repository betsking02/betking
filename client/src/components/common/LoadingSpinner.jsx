export default function LoadingSpinner({ size = 24 }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
      <div className="spinner" style={{ width: size, height: size }} />
    </div>
  );
}
