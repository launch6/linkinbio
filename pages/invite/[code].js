// pages/invite/[code].js
export async function getServerSideProps(ctx) {
  const { code } = ctx.params; // /invite/username → "username"
  return {
    redirect: {
      destination: `/pricing?ref=${encodeURIComponent(code)}`,
      permanent: false,
    },
  };
}

export default function Invite() {
  return null;
}
