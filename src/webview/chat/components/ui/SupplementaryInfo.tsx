import React from 'react';

interface SupplementaryInfoProps {
    items: string[];
}

const SupplementaryInfo: React.FC<SupplementaryInfoProps> = ({ items }) => {
    if (!items || items.length === 0) {
        return null;
    }

    return (
        <div className="supplementary-info">
            {items.map((content, index) => (
                <div key={index} className="supplementary-info-item">
                    ⎿ {content}
                </div>
            ))}
        </div>
    );
};

export default SupplementaryInfo;
