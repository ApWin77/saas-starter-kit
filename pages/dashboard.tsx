import { Loading } from '@/components/shared';
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { getSession } from 'next-auth/react';
import type { NextPageWithLayout } from 'types';

const Dashboard: NextPageWithLayout = () => {
  // This page just shows loading while redirecting
  return <Loading />;
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: '/auth/login',
        permanent: false,
      },
    };
  }

  // Redirect authenticated users to the chat page
  return {
    redirect: {
      destination: '/chat',
      permanent: false,
    },
  };
}

export default Dashboard;
