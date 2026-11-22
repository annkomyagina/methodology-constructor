import { useState } from 'react';
import { Button, Layout, Space, Typography } from 'antd';
import { AppstoreOutlined, BookOutlined, FileTextOutlined } from '@ant-design/icons';
import ConstructorApp from './ConstructorApp';
import RegistryPage from './registry/RegistryPage';

const { Text } = Typography;

type Workspace = 'registry' | 'constructor';

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>('registry');
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e1e6ee', minHeight: 62, padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Space align="center"><AppstoreOutlined style={{ color: '#1b5b92', fontSize: 22 }} /><Text strong style={{ fontSize: 16 }}>СтатМетод</Text></Space>
        <Space wrap>
          <Button type={workspace === 'registry' ? 'primary' : 'text'} icon={<BookOutlined />} onClick={() => setWorkspace('registry')}>Реестр ОСМ</Button>
          <Button type={workspace === 'constructor' ? 'primary' : 'text'} icon={<FileTextOutlined />} onClick={() => setWorkspace('constructor')}>Конструктор методологии</Button>
        </Space>
      </div>
      {workspace === 'registry' ? <RegistryPage /> : <ConstructorApp />}
    </Layout>
  );
}
