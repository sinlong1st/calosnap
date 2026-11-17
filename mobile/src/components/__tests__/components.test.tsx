import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { toSavedMeal } from '@/api/mock/fixtures';
import type { LocalDate } from '@/domain/types';

import { Button } from '../Button';
import { CalorieArc } from '../CalorieArc';
import { MacroBar } from '../MacroBar';
import { MealCard } from '../MealCard';
import { SegmentedControl } from '../SegmentedControl';
import { SelectableCard } from '../SelectableCard';
import { Toast } from '../Toast';
import { WeekStrip } from '../WeekStrip';

describe('CalorieArc', () => {
  it('shows remaining calories with the Design §11 screen-reader label', async () => {
    await render(<CalorieArc consumed={1120} target={2050} />);
    expect(screen.getByText('930')).toBeOnTheScreen();
    expect(screen.getByText('kcal remaining')).toBeOnTheScreen();
    expect(screen.getByLabelText('930 of 2,050 calories remaining')).toBeOnTheScreen();
    expect(screen.getAllByTestId('arc-seg-filled')).toHaveLength(8);
    expect(screen.getAllByTestId('arc-seg-empty')).toHaveLength(7);
  });

  it('over target: all segments filled and "kcal over" shown', async () => {
    await render(<CalorieArc consumed={2925} target={2050} />);
    expect(screen.getByText('875')).toBeOnTheScreen();
    expect(screen.getByText('kcal over')).toBeOnTheScreen();
    expect(screen.getAllByTestId('arc-seg-filled')).toHaveLength(15);
    expect(screen.queryAllByTestId('arc-seg-empty')).toHaveLength(0);
  });
});

describe('MacroBar', () => {
  it('shows grams left and an accessible summary (H2)', async () => {
    await render(<MacroBar name="Protein" eaten={88} target={165} />);
    expect(screen.getByText('77 g left')).toBeOnTheScreen();
    expect(screen.getByLabelText('Protein, 88 of 165 grams, 77 left')).toBeOnTheScreen();
  });

  it('hides the remaining tail on an empty day (H1)', async () => {
    await render(<MacroBar name="Fat" eaten={0} target={62} showRemaining={false} />);
    expect(screen.queryByText(/g left/)).toBeNull();
  });

  it('reports grams over and clips the fill', async () => {
    await render(<MacroBar name="Fat" eaten={70} target={62} />);
    expect(screen.getByText('8 g over')).toBeOnTheScreen();
    expect(screen.getByTestId('macro-fill')).toHaveStyle({ width: '100%' });
  });
});

describe('Button', () => {
  it('calls onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Scan a meal" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Scan a meal' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled or loading', async () => {
    const onPress = jest.fn();
    await render(
      <>
        <Button label="Analyze" onPress={onPress} disabled />
        <Button label="Save" onPress={onPress} loading />
      </>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Analyze' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeDisabled();
  });
});

describe('SegmentedControl', () => {
  function Harness() {
    const [v, setV] = useState<'auto' | 'precision'>('auto');
    return (
      <SegmentedControl
        value={v}
        onChange={setV}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'precision', label: 'Precision' },
        ]}
      />
    );
  }

  it('moves the selection', async () => {
    await render(<Harness />);
    expect(screen.getByRole('radio', { name: 'Auto' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Precision' }));
    expect(screen.getByRole('radio', { name: 'Precision' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Auto' })).not.toBeChecked();
  });
});

describe('SelectableCard', () => {
  it('exposes radio state and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<SelectableCard title="Gym cut" description="Lose fat while keeping muscle." selected onPress={onPress} />);
    const card = screen.getByRole('radio');
    expect(card).toBeChecked();
    await fireEvent.press(card);
    expect(onPress).toHaveBeenCalled();
  });
});

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('auto-dismisses after 6 s and supports Undo', async () => {
    const onDismiss = jest.fn();
    const onUndo = jest.fn();
    await render(
      <Toast visible message="Lunch saved · 675 kcal added" actionLabel="Undo" onAction={onUndo} onDismiss={onDismiss} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(5999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when hidden', async () => {
    await render(<Toast visible={false} message="x" onDismiss={() => {}} />);
    expect(screen.queryByTestId('toast')).toBeNull();
  });
});

describe('MealCard and WeekStrip', () => {
  const D = '2026-11-16' as LocalDate;

  it('renders the meal row content from the design', async () => {
    const meal = toSavedMeal(D, { name: 'Turkey wrap', type: 'snack', time: '10:45', kcal: 600, p: 64, c: 56, f: 18 });
    await render(<MealCard meal={meal} />);
    expect(screen.getByText('Turkey wrap')).toBeOnTheScreen();
    expect(screen.getByText('Snack · 10:45 · 64 g protein')).toBeOnTheScreen();
    expect(screen.getByText('600')).toBeOnTheScreen();
  });

  it('marks the selected day and reports taps', async () => {
    const onSelect = jest.fn();
    const days = ['2026-11-15', '2026-11-16'] as LocalDate[];
    await render(<WeekStrip days={days} selected={D} onSelect={onSelect} />);
    expect(screen.getByRole('tab', { name: 'Monday 16 November' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Sunday 15 November' }));
    expect(onSelect).toHaveBeenCalledWith('2026-11-15');
  });
});
