const AWS = require('aws-sdk');

module.exports = (instanceIdentifier) => {
    return new Promise((resolve, reject) => {
        const rds = new AWS.RDS();
        const params = {
            DBInstanceIdentifier: instanceIdentifier,
        };
        rds.stopDBInstance(params, (err, data)=> {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
};
