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
            '#': {
                authService: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './AuthService',
                },
                post: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, url: string, body: any) {
                        if (url === '/api/auth/login') {
                            return this.authService.authenticate(body)
                        }
                        return { success: false, error: 'Unknown endpoint' }
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
capsule['#'] = '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Codepath/examples/01-SimplePasswordLogin/caps/HttpClient'
