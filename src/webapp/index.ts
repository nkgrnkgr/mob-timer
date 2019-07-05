(() => {
  let evtSource: EventSource | null = null;
  let connectionTimeoutWatcher: ConnectionTimeoutWatcher | null = null;

  window.onload = () => {
    Notification.requestPermission();
    setupConnectionTimeoutWatcher();
    evtSource = setupEventSource();
    setupTimerButtons();
    setupNameInput();
    setupReconnectButton();
    updateConnectionStatusAndButton(true);
    fetch('/status')
      .then(res => res.json())
      .then(json => updateTime(json.time));
  };

  function updateConnectionStatusAndButton(isConnected: boolean) {
    const status = document.querySelector('.connection-status');
    if (isConnected) {
      status.textContent = '';
      hideReconnectButton();
    } else {
      status.textContent = 'Disconnected...';
      showReconnectButton();
    }
  }

  function setupConnectionTimeoutWatcher() {
    connectionTimeoutWatcher = new ConnectionTimeoutWatcher(() => {
      updateConnectionStatusAndButton(false);
    });
    connectionTimeoutWatcher.notifyConnected();
  }

  class ConnectionTimeoutWatcher {
    private connected: boolean;
    private onDisconnected: Function;
    private timeout: NodeJS.Timeout | null;
    static readonly TIMEOUT_SEC: number = 10;

    constructor(onDisconnected: Function) {
      this.connected = true;
      this.onDisconnected = onDisconnected;
      this.timeout = null;
    }

    notifyConnected() {
      if (this.timeout) {
        clearTimeout(this.timeout);
      }
      this.timeout = setTimeout(() => {
        this.connected = false;
        this.onDisconnected();
      }, ConnectionTimeoutWatcher.TIMEOUT_SEC * 1000);
    }
  }

  function setupNameInput() {
    const input = getNameInput();
    input.addEventListener('change', e => {
      window.localStorage.setItem('name', (<HTMLInputElement>e.target).value);
    });
    const savedName = window.localStorage.getItem('name');
    input.value = savedName || '';
  }

  function getReconnectButton(): HTMLElement {
    return document.querySelector('.reconnect');
  }

  function setupReconnectButton() {
    const button = getReconnectButton();
    button.addEventListener('click', handleClickReconnectButton);
  }

  function handleClickReconnectButton(e: Event) {
    const target = <HTMLButtonElement>e.target;
    target.disabled = true;
    setTimeout(() => (target.disabled = false), 5000);

    if (evtSource) {
      evtSource.close();
      evtSource = null;
    }
    evtSource = setupEventSource();
  }

  function showReconnectButton() {
    getReconnectButton().setAttribute('style', '');
  }

  function hideReconnectButton() {
    getReconnectButton().setAttribute('style', 'display: none;');
  }

  function setupEventSource() {
    const evtSource = new EventSource('/events/');
    const common = (e: MessageEvent) => {
      console.log(`${e.type}: ${e.data}`);
      connectionTimeoutWatcher.notifyConnected();
      updateConnectionStatusAndButton(true);
    };
    evtSource.addEventListener('tick', (e: MessageEvent) => {
      common(e);
      const data = JSON.parse(e.data);
      updateTime(parseInt(data.sec));
    });
    evtSource.addEventListener('start', (e: MessageEvent) => {
      common(e);
      const data = JSON.parse(e.data);
      const sec = parseInt(data.sec);
      updateTime(sec);
      sendNotificationIfPossible(
        `Timer started by ${data.name} (${secondToDisplayTime(sec)})`
      );
    });
    evtSource.addEventListener('stop', (e: MessageEvent) => {
      common(e);
      const data = JSON.parse(e.data);
      const sec = parseInt(data.sec);
      updateTime(sec);
      sendNotificationIfPossible(
        `Timer stopped by ${data.name} (${secondToDisplayTime(sec)})`
      );
    });
    evtSource.addEventListener('over', (e: MessageEvent) => {
      common(e);
      sendNotificationIfPossible('Time ended');
    });
    evtSource.addEventListener('alive', (e: MessageEvent) => {
      common(e);
    });

    return evtSource;
  }

  function getNameInput(): HTMLInputElement {
    return document.querySelector('input#name-input');
  }

  function getName() {
    return encodeURIComponent(getNameInput().value);
  }

  function setupTimerButtons() {
    [25, 20, 15, 10, 5].forEach(min => {
      document
        .getElementsByClassName(`start-${min}-min`)[0]
        .addEventListener('click', e => {
          fetch(`/reset?sec=${min * 60}&name=${getName()}`, { method: 'POST' });
        });
    });
    document
      .getElementsByClassName('toggle')[0]
      .addEventListener('click', e => {
        fetch(`/toggle?name=${getName()}`, { method: 'POST' })
          .then(res => res.json())
          .then(json => {
            updateTime(json.time);
          });
      });
  }

  function updateTime(sec: number) {
    document.getElementsByClassName(
      'time'
    )[0].textContent = secondToDisplayTime(sec);
  }

  function sendNotificationIfPossible(msg: string) {
    if (Notification.permission === 'granted') {
      const n = new Notification('Mob Timer', {
        body: msg,
        renotify: true,
        tag: 'mob-timer'
      });
      n.onclick = () => window.focus();
    }
  }

  function secondToDisplayTime(sec: number) {
    return (
      `${Math.floor(sec / 60)}`.padStart(2, '0') +
      ':' +
      `${sec % 60}`.padStart(2, '0')
    );
  }
})();