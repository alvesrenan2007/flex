export default function Logo({ size = 45 }) {
  return (
    <img
      src="/flex-logo.png"
      width={size}
      height={size * 0.752}
      role="img"
      aria-label="FLEX"
    />
  );
}
