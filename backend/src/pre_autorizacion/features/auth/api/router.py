"""Auth router — `/api/v1/auth/...`."""

from __future__ import annotations

from fastapi import APIRouter, status

from pre_autorizacion.features.auth.api.schemas import (
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RefreshResponse,
    UserOut,
)
from pre_autorizacion.features.auth.application.use_cases import (
    LoginUseCase,
    RefreshTokenUseCase,
)
from pre_autorizacion.shared.api.deps import (
    CurrentUserDep,
    JwtServiceDep,
    UserRepositoryDep,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Email + password → access + refresh tokens.",
)
async def login(
    body: LoginRequest,
    users: UserRepositoryDep,
    jwt_service: JwtServiceDep,
) -> LoginResponse:
    use_case = LoginUseCase(users=users, jwt_service=jwt_service)
    pair = await use_case.execute(body.email, body.password)
    return LoginResponse(
        access_token=pair.access_token,
        refresh_token=pair.refresh_token,
        user=UserOut.from_domain(pair.user),
    )


@router.post(
    "/refresh",
    response_model=RefreshResponse,
    status_code=status.HTTP_200_OK,
    summary="Refresh token → nuevo access token.",
)
async def refresh(
    body: RefreshRequest,
    users: UserRepositoryDep,
    jwt_service: JwtServiceDep,
) -> RefreshResponse:
    use_case = RefreshTokenUseCase(users=users, jwt_service=jwt_service)
    access_token = await use_case.execute(body.refresh_token)
    return RefreshResponse(access_token=access_token)


@router.get(
    "/me",
    response_model=UserOut,
    summary="Usuario actual a partir del access token.",
)
async def me(user: CurrentUserDep) -> UserOut:
    return UserOut.from_domain(user)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Logout — en MVP no invalida tokens (stateless).",
)
async def logout(user: CurrentUserDep) -> None:
    # MVP: el cliente borra el token. Phase B3+: blacklist o rotation con refresh-id.
    _ = user
    return None


__all__ = ["router"]
