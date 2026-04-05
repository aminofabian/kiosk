import { CustomerCreditPublicView } from '@/components/public/CustomerCreditPublicView';

export const metadata = {
  title: 'Your credit status',
  robots: { index: false, follow: false },
};

export default async function CustomerCreditPublicPage({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  const { phone } = await params;
  return <CustomerCreditPublicView phoneSlug={phone} />;
}
