import React from 'react';

interface ComingSoonPageProps {
    title: string;
}

const ComingSoonPage: React.FC<ComingSoonPageProps> = ({ title }) => {
    return (
        <div>此功能正在开发中，将在后续版本中提供。</div>
    );
};

export default ComingSoonPage;