// Add UI connection status component
export const ConnectionStatus = ({ client }) => {
    const [status, setStatus] = useState({
        state: 'disconnected',
        metrics: { latency: 0, packetLoss: 0 }
    });

    useEffect(() => {
        const handler = (newStatus) => setStatus(newStatus);
        client.on('state', handler);
        return () => client.off('state', handler);
    }, [client]);

    const getStatusColor = () => {
        switch(status.state) {
            case 'connected': 
                return status.metrics.latency < 100 ? 'green' : 'orange';
            case 'reconnecting':
                return 'yellow';
            case 'disconnected':
                return 'red';
            default:
                return 'gray';
        }
    };

    return (
        <div className="connection-status">
            <span className={`indicator ${getStatusColor()}`} />
            <span>{status.state}</span>
            {status.state === 'connected' && (
                <span className="latency">{status.metrics.latency}ms</span>
            )}
            <button onClick={() => client.connect()}>Reconnect</button>
        </div>
    );
};