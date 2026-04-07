// Test cases for ConnectionStatus component
import { render, screen } from '@testing-library/react';
import { ConnectionStatus } from './ConnectionStatus';

describe('ConnectionStatus', () => {
    const mockClient = {
        on: jest.fn(),
        off: jest.fn(),
        connect: jest.fn(),
        state: 'disconnected'
    };

    test('renders connection state', () => {
        render(<ConnectionStatus client={mockClient} />);
        expect(screen.getByText('disconnected')).toBeInTheDocument();
    });

    test('shows reconnect button', () => {
        render(<ConnectionStatus client={mockClient} />);
        expect(screen.getByRole('button', { name: 'Reconnect' })).toBeInTheDocument();
    });

    test('displays latency when connected', () => {
        const connectedClient = {
            ...mockClient,
            state: 'connected',
            metrics: { latency: 42 }
        };
        render(<ConnectionStatus client={connectedClient} />);
        expect(screen.getByText('42ms')).toBeInTheDocument();
    });
});