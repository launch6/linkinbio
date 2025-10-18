export async function getServerSideProps(ctx){
  const { code } = ctx.params;
  return { redirect: { destination: `/pricing?ref=${encodeURIComponent(code)}`, permanent: false } };
}
export default function Ref(){ return null; }
