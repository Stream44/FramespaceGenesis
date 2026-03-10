export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: {
    encapsulate: any
    CapsulePropertyTypes: any
    makeImportStack: any
}) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},

            // Dimension: Column
            '#../view/Columns/Service': {},

            // Dimension: Row
            '#../view/Rows/Server': {},

            '#': {
                authenticate: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, credentials: { email: string; password: string }) {
                        const { email, password } = credentials

                        if (!email || !email.includes('@')) {
                            return { success: false, error: 'Invalid email format' }
                        }

                        if (!password || password.length < 8) {
                            return { success: false, error: 'Invalid credentials' }
                        }

                        return {
                            success: true,
                            token: `token-${email}`,
                            redirectUrl: '/dashboard'
                        }
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/FramespaceGenesis/L8-view-models/Composite/Quadrant-Codepath/examples/01-SimplePasswordLogin/caps/AuthService'
