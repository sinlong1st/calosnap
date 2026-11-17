import { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';

import { ApiProvider } from '@/api/ApiProvider';
import type { MockScenario } from '@/api/mock/fixtures';
import { MockApiClient } from '@/api/mock/MockApiClient';
import TabsLayout from '@/app/(tabs)/_layout';
import HistoryRoute from '@/app/(tabs)/history';
import ScanRoute from '@/app/scan';
import { ClockProvider } from '@/domain/clock';

import { HomeScreen } from '../HomeScreen';

// Monday 16 Nov 2026, 14:30 local.
const NOW = () => new Date(2026, 10, 16, 14, 30);

async function renderApp(scenario: MockScenario = 'inProgress') {
  const client = new MockApiClient({ latencyMs: 0, now: NOW, scenario });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function RootLayout() {
    return (
      <ClockProvider now={NOW}>
        <ApiProvider client={client} queryClient={queryClient}>
          <Stack screenOptions={{ headerShown: false }} />
        </ApiProvider>
      </ClockProvider>
    );
  }

  await renderRouter(
    {
      _layout: RootLayout,
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': HomeScreen,
      '(tabs)/history': HistoryRoute,
      scan: ScanRoute,
      profile: () => null,
    },
    { initialUrl: '/' },
  );
  return { client, queryClient };
}

describe('Home dashboard', () => {
  it('H2: shows totals from saved meals, macros left and today’s meals', async () => {
    await renderApp('inProgress');
    expect(await screen.findByText('930')).toBeOnTheScreen();
    expect(screen.getByText('Monday, 16 Nov')).toBeOnTheScreen();
    expect(screen.getByText('Good afternoon, Maya')).toBeOnTheScreen();
    expect(screen.getByText('Gym cut · 2,050')).toBeOnTheScreen();
    expect(screen.getByText('1,120 eaten of 2,050')).toBeOnTheScreen();
    expect(screen.getByText('77 g left')).toBeOnTheScreen();
    expect(screen.getByText('Oats & peanut butter')).toBeOnTheScreen();
    expect(screen.getByText('Turkey wrap')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Monday 16 November' })).toBeSelected();
    expect(screen.queryByTestId('empty-day')).toBeNull();
  });

  it('H1: empty day shows the save-rule empty state and full target remaining', async () => {
    await renderApp('emptyDay');
    expect(await screen.findByTestId('empty-day')).toBeOnTheScreen();
    expect(screen.getByText('2,050')).toBeOnTheScreen();
    expect(screen.getByText('No meals logged today')).toBeOnTheScreen();
    expect(screen.getByText("Take a photo of your next meal. It's only added after you review it and tap Save.")).toBeOnTheScreen();
    expect(screen.queryByText(/eaten of/)).toBeNull();
    expect(screen.queryByText(/g left/)).toBeNull();
  });

  it('new user: "Welcome" greeting and no week strip', async () => {
    await renderApp('newUser');
    expect(await screen.findByText('Welcome, Maya')).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Monday 16 November' })).toBeNull();
  });

  it('over target: shows kcal over, never a negative remaining', async () => {
    await renderApp('overTarget');
    expect(await screen.findByText('kcal over')).toBeOnTheScreen();
    expect(screen.getByLabelText('225 calories over your 2,050 calorie target')).toBeOnTheScreen();
  });

  it('no target: shows eaten totals without an arc', async () => {
    await renderApp('noTarget');
    expect(await screen.findByText('kcal eaten today')).toBeOnTheScreen();
    expect(screen.queryByTestId('calorie-arc')).toBeNull();
  });
});

describe('Navigation', () => {
  it('History tab and Today → History link open the History tab', async () => {
    await renderApp();
    await screen.findByText('930');
    await fireEvent.press(screen.getByTestId('tab-history'));
    expect(screen).toHavePathname('/history');
    await fireEvent.press(screen.getByTestId('tab-index'));
    expect(screen).toHavePathname('/');
    await fireEvent.press(screen.getByRole('link', { name: 'History' }));
    expect(screen).toHavePathname('/history');
  });

  it('week strip opens History for that day', async () => {
    await renderApp();
    await screen.findByText('930');
    await fireEvent.press(screen.getByRole('tab', { name: 'Sunday 15 November' }));
    expect(screen).toHavePathname('/history');
    expect(screen.getByText(/Requested day: Sunday 15 November/)).toBeOnTheScreen();
  });

  it('Scan opens the scan modal, and closing it leaves totals unchanged', async () => {
    await renderApp();
    await screen.findByText('930');
    await fireEvent.press(screen.getByTestId('tab-scan'));
    expect(screen).toHavePathname('/scan');
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen).toHavePathname('/');
    expect(await screen.findByText('930')).toBeOnTheScreen();
  });

  it('avatar opens Profile', async () => {
    await renderApp();
    await screen.findByText('930');
    await fireEvent.press(screen.getByRole('button', { name: 'Profile and settings' }));
    expect(screen).toHavePathname('/profile');
  });
});
