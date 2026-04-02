const {
  normalizeCnbPolicyVersion,
  resolveCnbPolicyVersion
} = require('./cnbVersionPolicy');

describe('CodeBuildConfig CNB version policy helpers', () => {
  it('normalizes java patch versions to visible majors', () => {
    expect(normalizeCnbPolicyVersion('java', '17.0.12')).toEqual('17');
    expect(normalizeCnbPolicyVersion('java', '1.8')).toEqual('8');
  });

  it('falls back to default php version when current value is retired', () => {
    expect(
      resolveCnbPolicyVersion('php', ['8.3', '8.4', '8.5'], '8.2', '8.4')
    ).toEqual('8.4');
  });

  it('keeps normalized go version when the current patch release is still visible', () => {
    expect(
      resolveCnbPolicyVersion('golang', ['1.24', '1.25'], '1.24.7', '1.25')
    ).toEqual('1.24');
  });

  it('falls back to default java version when current gradle version is retired', () => {
    expect(
      resolveCnbPolicyVersion('java', ['17', '21'], '11.0.25', '17')
    ).toEqual('17');
  });
});
